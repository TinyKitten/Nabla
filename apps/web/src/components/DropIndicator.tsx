export function DropIndicator() {
  return (
    <div
      style={{
        width: 4,
        alignSelf: 'stretch',
        background: 'var(--accent)',
        borderRadius: 2,
        flexShrink: 0,
        boxShadow: '0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent)',
      }}
    />
  );
}
