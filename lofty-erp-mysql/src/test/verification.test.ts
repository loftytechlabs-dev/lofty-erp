import { describe, it, expect, beforeEach } from 'vitest';
import { localStore } from '../services/store';
import { verifyProductDelivery, confirmDeliveryDiscrepancy } from '../services/deliveryService';
import { verifySupplierBill } from '../services/billService';
import { recordSupplierPayment } from '../services/paymentService';
import { SAMPLE_BUSINESS, SAMPLE_PURCHASE_ORDERS, SAMPLE_DELIVERIES, SAMPLE_SUPPLIER_BILLS } from '../lib/mockData';

describe('Independent Verification & Inventory Integrity', () => {
  beforeEach(() => {
    localStore.resetToDefault();
    localStore.addSupplierBill({
      ...SAMPLE_SUPPLIER_BILLS[0],
      businessId: SAMPLE_BUSINESS.id,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      paidAmount: 0,
    });
  });

  it('updates inventory ONLY for accepted physical counts (Worked Example: 60 ordered, 55 usable accepted, 5 rejected)', async () => {
    const businessId = SAMPLE_BUSINESS.id;
    const initialBalances = localStore.getStockBalances(businessId);
    const teakInitial = initialBalances.find(b => b.productId === 'prod_teak_plank')?.quantity || 0;

    // Reset delivery status to test verification flow
    const testDeliveryId = 'del_test_worked_ex';
    localStore.addDelivery({
      id: testDeliveryId,
      businessId,
      purchaseOrderId: SAMPLE_PURCHASE_ORDERS[0].id,
      poNumber: 'PO-2026-0101',
      vendorName: 'Western Timber & Forest Supplies',
      warehouseId: 'wh_main_pune',
      warehouseName: 'Godown 1 — Pune Central Raw Materials',
      challanNumber: 'DC/WT/9999',
      challanDate: '2026-02-02',
      items: [
        {
          productId: 'prod_teak_plank',
          productName: 'Teak Wooden Planks (6ft x 4in x 1in)',
          sku: 'WD-TEAK-001',
          unit: 'Pcs',
          orderedQuantity: 60,
          deliveredQuantity: 60,
          acceptedQuantity: 0,
          rejectedQuantity: 0,
        },
      ],
      status: 'AWAITING_REVIEW',
      productVerificationStatus: 'PENDING',
      billVerificationStatus: 'PENDING',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    // Execute physical inspection accepting 55 and rejecting 5
    const res = await verifyProductDelivery(
      businessId,
      testDeliveryId,
      'test_actor_warehouse',
      [
        {
          productId: 'prod_teak_plank',
          acceptedQuantity: 55, // 55 usable accepted
          rejectedQuantity: 5, // 5 rejected
          inspectionNotes: '5 had splits',
        },
      ],
      'Physical inspection completed'
    );

    expect(res.success).toBe(true);
    expect(res.status).toBe('ACCEPTED_WITH_DISCREPANCY');

    // Check inventory balance: must increase by 55 (NOT 60!)
    const updatedBalances = localStore.getStockBalances(businessId);
    const teakUpdated = updatedBalances.find(b => b.productId === 'prod_teak_plank')?.quantity;
    expect(teakUpdated).toBe(teakInitial + 55);

    // Prevents duplicate approval
    const duplicateRes = await verifyProductDelivery(
      businessId,
      testDeliveryId,
      'test_actor_warehouse',
      [{ productId: 'prod_teak_plank', acceptedQuantity: 55, rejectedQuantity: 5 }]
    );
    expect(duplicateRes.success).toBe(false);
  });

  it('verifies that supplier bill verification does NOT alter inventory stock balances', async () => {
    const businessId = SAMPLE_BUSINESS.id;
    const initialBalances = localStore.getStockBalances(businessId);
    const teakInitial = initialBalances.find(b => b.productId === 'prod_teak_plank')?.quantity;

    // Verify supplier bill
    const res = await verifySupplierBill(
      businessId,
      SAMPLE_BUSINESS.name,
      SAMPLE_SUPPLIER_BILLS[0].id,
      'test_actor_accountant',
      'ACCEPT'
    );

    expect(res.success).toBe(true);
    expect(res.status).toBe('VERIFIED');

    // Balances must remain identical
    const afterBillBalances = localStore.getStockBalances(businessId);
    const teakAfter = afterBillBalances.find(b => b.productId === 'prod_teak_plank')?.quantity;
    expect(teakAfter).toBe(teakInitial);
  });

  it('correctly tracks partial payment and full settlement on supplier bills', async () => {
    const businessId = SAMPLE_BUSINESS.id;
    const bill = SAMPLE_SUPPLIER_BILLS[0]; // Total amount = 7080

    // Part payment of ₹4,000
    const partPayRes = await recordSupplierPayment(
      businessId,
      SAMPLE_BUSINESS.name,
      bill,
      {
        amount: 4000,
        paymentDate: '2026-02-03',
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'UTR-TEST-001',
        recordedBy: 'test_accountant',
      }
    );

    expect(partPayRes.success).toBe(true);
    expect(partPayRes.payment.amount).toBe(4000);

    const updatedBill = localStore.getSupplierBillById(businessId, bill.id);
    expect(updatedBill?.paidAmount).toBe(4000);
    expect(updatedBill?.paymentStatus).toBe('PARTIALLY_PAID');

    // Remaining payment of ₹3,080
    await recordSupplierPayment(
      businessId,
      SAMPLE_BUSINESS.name,
      updatedBill!,
      {
        amount: 3080,
        paymentDate: '2026-02-04',
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'UTR-TEST-002',
        recordedBy: 'test_accountant',
      }
    );

    const settledBill = localStore.getSupplierBillById(businessId, bill.id);
    expect(settledBill?.paidAmount).toBe(7080);
    expect(settledBill?.paymentStatus).toBe('PAID');
  });

  it('blocks physical verification when quantity discrepancy exists until owner approves (OK fine)', async () => {
    const businessId = SAMPLE_BUSINESS.id;
    const testDeliveryId = 'del_test_owner_disc';

    // Delivery submitted with quantity discrepancy (ordered 100, delivered 80)
    localStore.addDelivery({
      id: testDeliveryId,
      businessId,
      purchaseOrderId: SAMPLE_PURCHASE_ORDERS[0].id,
      poNumber: 'PO-2026-0101',
      vendorName: 'Western Timber & Forest Supplies',
      warehouseId: 'wh_main_pune',
      warehouseName: 'Godown 1 — Pune Central Raw Materials',
      challanNumber: 'DC/WT/8888',
      challanDate: '2026-02-02',
      items: [
        {
          productId: 'prod_teak_plank',
          productName: 'Teak Wooden Planks (6ft x 4in x 1in)',
          sku: 'WD-TEAK-001',
          unit: 'Pcs',
          orderedQuantity: 100,
          deliveredQuantity: 80, // Discrepancy!
          acceptedQuantity: 0,
          rejectedQuantity: 0,
        },
      ],
      hasQuantityDiscrepancy: true,
      ownerConfirmationStatus: 'PENDING',
      status: 'AWAITING_OWNER_CONFIRMATION',
      productVerificationStatus: 'PENDING',
      billVerificationStatus: 'PENDING',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    // 1. Warehouse worker tries to verify before owner approval -> MUST BE BLOCKED!
    const blockedRes = await verifyProductDelivery(
      businessId,
      testDeliveryId,
      'test_worker_uid',
      [{ productId: 'prod_teak_plank', acceptedQuantity: 80, rejectedQuantity: 0 }]
    );
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error).toContain('Waiting for Owner Confirmation');

    // 2. Owner approves the discrepancy ("OK Fine")
    const ownerApproveRes = await confirmDeliveryDiscrepancy(
      businessId,
      testDeliveryId,
      'owner_uid_akhil',
      'APPROVED',
      'Short delivery accepted, vendor will send balance later'
    );
    expect(ownerApproveRes.success).toBe(true);

    const approvedDel = localStore.getDeliveryById(businessId, testDeliveryId);
    expect(approvedDel?.ownerConfirmationStatus).toBe('APPROVED');
    expect(approvedDel?.status).toBe('AWAITING_REVIEW');

    // 3. Now warehouse worker can successfully inspect and verify physical goods!
    const verifiedRes = await verifyProductDelivery(
      businessId,
      testDeliveryId,
      'test_worker_uid',
      [{ productId: 'prod_teak_plank', acceptedQuantity: 80, rejectedQuantity: 0 }]
    );
    expect(verifiedRes.success).toBe(true);
  });

  it('correctly handles owner rejection of quantity discrepancy', async () => {
    const businessId = SAMPLE_BUSINESS.id;
    const testDeliveryId = 'del_test_owner_reject';

    localStore.addDelivery({
      id: testDeliveryId,
      businessId,
      purchaseOrderId: SAMPLE_PURCHASE_ORDERS[0].id,
      poNumber: 'PO-2026-0101',
      vendorName: 'Western Timber & Forest Supplies',
      warehouseId: 'wh_main_pune',
      warehouseName: 'Godown 1 — Pune Central Raw Materials',
      challanNumber: 'DC/WT/7777',
      challanDate: '2026-02-02',
      items: [
        {
          productId: 'prod_teak_plank',
          productName: 'Teak Wooden Planks (6ft x 4in x 1in)',
          sku: 'WD-TEAK-001',
          unit: 'Pcs',
          orderedQuantity: 100,
          deliveredQuantity: 40, // 60% shortage
          acceptedQuantity: 0,
          rejectedQuantity: 0,
        },
      ],
      hasQuantityDiscrepancy: true,
      ownerConfirmationStatus: 'PENDING',
      status: 'AWAITING_OWNER_CONFIRMATION',
      productVerificationStatus: 'PENDING',
      billVerificationStatus: 'PENDING',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    // Owner rejects delivery
    const rejectRes = await confirmDeliveryDiscrepancy(
      businessId,
      testDeliveryId,
      'owner_uid_akhil',
      'REJECTED',
      'Variance too high, return truck to supplier'
    );
    expect(rejectRes.success).toBe(true);

    const rejectedDel = localStore.getDeliveryById(businessId, testDeliveryId);
    expect(rejectedDel?.ownerConfirmationStatus).toBe('REJECTED');
    expect(rejectedDel?.status).toBe('REJECTED');
    expect(rejectedDel?.productVerificationStatus).toBe('REJECTED');

    // Verification attempt should fail
    const blockedRes = await verifyProductDelivery(
      businessId,
      testDeliveryId,
      'test_worker_uid',
      [{ productId: 'prod_teak_plank', acceptedQuantity: 40, rejectedQuantity: 0 }]
    );
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error).toContain('rejected by the business owner');
  });
});
