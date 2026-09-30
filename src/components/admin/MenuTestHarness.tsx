import { useEffect, useRef, useState } from 'react';
import { useMenuManager } from '@/hooks/useMenuManager';

type Props = {
  establishmentId: string;
};

type HarnessContext = {
  categoryA: string | null;
  categoryB: string | null;
  item0: string | null;
  item1: string | null;
  item2: string | null;
};

const PREFIX = '__MENU_HARNESS__';

function assert(condition: boolean, message: string, details?: unknown) {
  if (!condition) {
    console.error(`[MenuHarness] ASSERTION FAILED: ${message}`, details ?? '');
    throw new Error(message);
  }

  console.log(`[MenuHarness] ASSERTION OK: ${message}`, details ?? '');
}

function positions(
  items: Array<{ id: string; display_order: number }>,
  ids: string[]
) {
  return ids.map((id) => items.find((item) => item.id === id)?.display_order ?? null);
}

export default function MenuTestHarness({ establishmentId }: Props) {
  const manager = useMenuManager(establishmentId);
  const [phase, setPhase] = useState(0);
  const [context, setContext] = useState<HarnessContext>({
    categoryA: null,
    categoryB: null,
    item0: null,
    item1: null,
    item2: null,
  });
  const [failed, setFailed] = useState(false);
  const cleanupStarted = useRef(false);

  useEffect(() => {
    if (failed || manager.loading || manager.saving) return;

    const run = async () => {
      try {
        if (phase === 0) {
          console.log('[MenuHarness] START -> establishment:', establishmentId);
          console.log('[MenuHarness] CONTRACT NOTE: after deleting one of two remaining A items, A can only contain one item. Expected post-delete positions are therefore [0], not [0,1].');
          const category = await manager.addCategory({
            name: `${PREFIX} A ${Date.now()}`,
            active: true,
          });
          setContext((current) => ({ ...current, categoryA: category.id }));
          console.log('[MenuHarness] SEQUENCE A1 -> CREATE CATEGORY A: SUCCESS', category);
          setPhase(1);
          return;
        }

        if (phase === 1) {
          const category = await manager.addCategory({
            name: `${PREFIX} B ${Date.now()}`,
            active: true,
          });
          setContext((current) => ({ ...current, categoryB: category.id }));
          console.log('[MenuHarness] SEQUENCE A2 -> CREATE CATEGORY B: SUCCESS', category);
          setPhase(2);
          return;
        }

        if (phase === 2 && context.categoryA) {
          const item = await manager.addItem({
            category_id: context.categoryA,
            name: `${PREFIX} ITEM 0 ${Date.now()}`,
            price: 10,
          });
          setContext((current) => ({ ...current, item0: item.id }));
          console.log('[MenuHarness] SEQUENCE A3 -> CREATE ITEM 0: SUCCESS', item);
          setPhase(3);
          return;
        }

        if (phase === 3 && context.categoryA) {
          const item = await manager.addItem({
            category_id: context.categoryA,
            name: `${PREFIX} ITEM 1 ${Date.now()}`,
            price: 11,
          });
          setContext((current) => ({ ...current, item1: item.id }));
          console.log('[MenuHarness] SEQUENCE A4 -> CREATE ITEM 1: SUCCESS', item);
          setPhase(4);
          return;
        }

        if (phase === 4 && context.categoryA) {
          const item = await manager.addItem({
            category_id: context.categoryA,
            name: `${PREFIX} ITEM 2 ${Date.now()}`,
            price: 12,
          });
          setContext((current) => ({ ...current, item2: item.id }));
          console.log('[MenuHarness] SEQUENCE A5 -> CREATE ITEM 2: SUCCESS', item);
          setPhase(5);
          return;
        }

        if (phase === 5 && context.categoryA) {
          const group = manager.itemsByCategory[context.categoryA] ?? [];
          assert(
            group.map((entry) => entry.display_order).join(',') === '0,1,2',
            'CREATE 3 ITEMS -> Category A positions are [0,1,2]',
            group.map((entry) => ({ id: entry.id, display_order: entry.display_order }))
          );
          console.log('[MenuHarness] SEQUENCE A -> SUCCESS');
          setPhase(6);
          return;
        }

        if (phase === 6 && context.item0 && context.categoryB) {
          await manager.moveItem(context.item0, context.categoryB);
          console.log('[MenuHarness] SEQUENCE B1 -> MOVE ITEM 0: SUCCESS');
          setPhase(7);
          return;
        }

        if (phase === 7 && context.categoryA && context.categoryB) {
          const source = manager.itemsByCategory[context.categoryA] ?? [];
          const destination = manager.itemsByCategory[context.categoryB] ?? [];
          assert(
            source.map((entry) => entry.display_order).join(',') === '0,1',
            'MOVE ITEM 0 -> Category A positions are [0,1]',
            source.map((entry) => ({ id: entry.id, display_order: entry.display_order }))
          );
          assert(
            destination.map((entry) => entry.display_order).join(',') === '0',
            'MOVE ITEM 0 -> Category B positions are [0]',
            destination.map((entry) => ({ id: entry.id, display_order: entry.display_order }))
          );
          console.log('[MenuHarness] SEQUENCE B -> SUCCESS');
          setPhase(8);
          return;
        }

        if (phase === 8 && context.item1) {
          await manager.deleteItem(context.item1);
          console.log('[MenuHarness] SEQUENCE C1 -> DELETE ITEM 1: SUCCESS');
          setPhase(9);
          return;
        }

        if (phase === 9 && context.categoryA) {
          const source = manager.itemsByCategory[context.categoryA] ?? [];
          assert(
            source.length === 1 && source[0].display_order === 0,
            'DELETE ITEM 1 -> Category A contains one remaining item at position [0] (deleteItem auto-reindexes)',
            source.map((entry) => ({ id: entry.id, display_order: entry.display_order }))
          );
          console.log('[MenuHarness] SEQUENCE C -> SUCCESS');
          setPhase(10);
          return;
        }

        if (phase === 10) {
          await manager.reindexAll();
          console.log('[MenuHarness] SEQUENCE D1 -> REINDEX: SUCCESS');
          setPhase(11);
          return;
        }

        if (phase === 11 && context.categoryA) {
          const source = manager.itemsByCategory[context.categoryA] ?? [];
          assert(
            source.map((entry) => entry.display_order).join(',') === '0',
            'REINDEX -> Category A positions are contiguous [0]',
            source.map((entry) => ({ id: entry.id, display_order: entry.display_order }))
          );
          console.log('[MenuHarness] SEQUENCE D -> SUCCESS (all positions aligned)');
          setPhase(12);
          return;
        }

        if (phase === 12 && !cleanupStarted.current && context.item0) {
          cleanupStarted.current = true;
          console.log('[MenuHarness] CLEANUP 1/4 -> deleting temporary item 0');
          await manager.deleteItem(context.item0);
          setPhase(13);
          return;
        }

        if (phase === 13 && context.item2) {
          console.log('[MenuHarness] CLEANUP 2/4 -> deleting temporary item 2');
          await manager.deleteItem(context.item2);
          setPhase(14);
          return;
        }

        if (phase === 14 && context.categoryA) {
          console.log('[MenuHarness] CLEANUP 3/4 -> deleting temporary category A');
          await manager.deleteCategory(context.categoryA);
          setPhase(15);
          return;
        }

        if (phase === 15 && context.categoryB) {
          console.log('[MenuHarness] CLEANUP 4/4 -> deleting temporary category B');
          await manager.deleteCategory(context.categoryB);
          console.log('[MenuHarness] CERTIFICATION RUN COMPLETE -> ALL ASSERTIONS PASSED + CLEANUP COMPLETE');
          setPhase(16);
          return;
        }
      } catch (error) {
        setFailed(true);
        console.error('[MenuHarness] TORTURE TEST FAILED:', error);
      }
    };

    void run();
  }, [context, establishmentId, failed, manager, phase]);

  if (phase === 16) return null;

  return null;
}
