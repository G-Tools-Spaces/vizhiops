import { DocsNav } from "@/components/DocsNav";
import { Toc } from "@/components/Toc";

/**
 * Three columns: navigation that stays put, a reading column that does not
 * grow past a comfortable measure however wide the window gets, and an
 * "on this page" rail that appears on wide screens.
 */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-4">
          <DocsNav />
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-12">{children}</main>
      <aside className="hidden w-52 shrink-0 xl:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-4">
          <Toc />
        </div>
      </aside>
    </div>
  );
}
