/**
 * Anti-Spam Protection Component
 * Honeypot field to catch bots
 */

interface AntiSpamProtectionProps {
  enabled: boolean;
  value: string;
  onChange: (value: string) => void;
}

export function AntiSpamProtection({ enabled, value, onChange }: AntiSpamProtectionProps) {
  if (!enabled) return null;

  return (
    <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
      <label htmlFor="website_url">Website</label>
      <input
        type="text"
        id="website_url"
        name="website_url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
    </div>
  );
}
