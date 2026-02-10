export type AppLayoutModel = {
  sidebarWidth: number;
  treeMarkup: string;
  editorContentMarkup: string;
};

export const renderAppLayout = (model: AppLayoutModel): string => `
  <div class="app-shell" style="--sidebar-width: ${model.sidebarWidth}px;">
    <aside class="sidebar">
      <h1 class="brand">TestoDesignSuite</h1>

      <section class="tree-section">
        <div class="section-header">
          <h2 class="section-title">Structure</h2>
          <button data-action="add-root-node">+ Root Node</button>
        </div>
        <div class="tree-scroll">
          <ul class="tree-list">${model.treeMarkup}</ul>
        </div>
      </section>
    </aside>
    <div class="sidebar-resizer" data-action="start-resize" title="Resize sidebar" aria-label="Resize sidebar"></div>

    <main class="main-panel">
      ${model.editorContentMarkup}
    </main>
  </div>
`;
