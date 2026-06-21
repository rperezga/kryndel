'use client';

export function HeaderSearchTrigger() {
  const handleClick = () => {
    window.dispatchEvent(new Event('toggle-command-palette'));
  };

  return (
    <button
      onClick={handleClick}
      className="bg-ds-shell border border-solid border-ds-border rounded-lg px-3 py-1.5 text-xs text-ds-text-3 font-ds-mono flex items-center gap-4 hover:border-ds-green/30 transition-colors cursor-pointer outline-none focus-visible:border-ds-green"
      aria-label="Search and run commands"
    >
      <span className="text-ds-text-3">Search...</span>
      <kbd className="bg-ds-panel px-1 py-0.5 rounded text-[10px] text-ds-text-2 border border-solid border-ds-border select-none">
        ⌘K
      </kbd>
    </button>
  );
}
