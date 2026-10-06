import type { Dispatcher } from './dispatcher';
import { archiveProduct, listLookups, listMoneyAccounts, listProducts, listSuppliers, partyLedger, saveLookup, saveProduct, saveSupplier } from './catalog';
import { assertManager, getPurchase, listAdjustments, listBatches, listPurchases, stockAlerts, stockMovements } from './inbound';
import { currentBusinessDate } from './coreServices';
import { loadSettings } from '../settings';
import { postPurchase, postPurchaseReturn, voidPurchase, voidPurchaseReturn } from '../purchases';
import { postPayment, voidPayment } from '../money';
import { postStockAdjustment, voidStockAdjustment } from '../adjustments';

/** Phase 5: catalog, suppliers, purchases, stock, batches and adjustments. */
export function registerCatalogServices(d: Dispatcher): void {
  d.register('catalog:products', ({ ctx, session, input }) => listProducts(ctx, session!.role, input.includeArchived));
  d.register('catalog:productSave', ({ ctx, input }) => ({ id: saveProduct(ctx, input) }));
  d.register('catalog:productArchive', ({ ctx, input }) => {
    archiveProduct(ctx, input.id, input.archived);
    return null;
  });
  d.register('catalog:lookups', ({ ctx }) => listLookups(ctx));
  d.register('catalog:lookupSave', ({ ctx, input }) => ({ id: saveLookup(ctx, input) }));
  d.register('catalog:suppliers', ({ ctx, input }) => listSuppliers(ctx, input.includeArchived));
  d.register('catalog:supplierSave', ({ ctx, input }) => ({ id: saveSupplier(ctx, input) }));

  d.register('money:accounts', ({ ctx }) => listMoneyAccounts(ctx));
  d.register('party:ledger', ({ ctx, session, input }) => {
    if (input.kind === 'supplier') assertManager(session?.role);
    return partyLedger(ctx, input.kind, input.id, input.from, input.to);
  });
  d.register('payment:save', ({ ctx, session, input }) => {
    if (input.partyKind === 'supplier') assertManager(session?.role);
    return postPayment(ctx, { partyKind: input.partyKind, partyId: input.partyId, amount: input.amount, date: input.date, accountId: input.accountId, reference: input.reference, note: input.note });
  });
  d.register('payment:void', ({ ctx, input }) => {
    voidPayment(ctx, input.id, input.reason);
    return null;
  });

  d.register('purchase:save', ({ ctx, input }) => postPurchase(ctx, input));
  d.register('purchase:list', ({ ctx, input }) => listPurchases(ctx, input));
  d.register('purchase:get', ({ ctx, input }) => getPurchase(ctx, input.id));
  d.register('purchase:void', ({ ctx, input }) => {
    voidPurchase(ctx, input.id, input.reason);
    return null;
  });
  d.register('purchase:return', ({ ctx, input }) => postPurchaseReturn(ctx, input));
  d.register('purchase:returnVoid', ({ ctx, input }) => {
    voidPurchaseReturn(ctx, input.id, input.reason);
    return null;
  });

  d.register('stock:movements', ({ ctx, session, input }) => stockMovements(ctx, session!.role, input));
  d.register('stock:batches', ({ ctx, input }) => listBatches(ctx, currentBusinessDate(ctx, loadSettings(ctx.db)), input));
  d.register('stock:alerts', ({ ctx, input }) => stockAlerts(ctx, currentBusinessDate(ctx, loadSettings(ctx.db)), input.soonDays));
  d.register('stock:adjust', ({ ctx, input }) => postStockAdjustment(ctx, input));
  d.register('stock:adjustments', ({ ctx, session, input }) => listAdjustments(ctx, session!.role, input));
  d.register('stock:adjustVoid', ({ ctx, input }) => {
    voidStockAdjustment(ctx, input.id, input.reason);
    return null;
  });
}

