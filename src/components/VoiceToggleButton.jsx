export default function VoiceToggleButton({ enabled, onToggle }) {
  return (
    <button
      className={`voice-toggle-btn${enabled ? ' voice-toggle-btn--on' : ''}`}
      onClick={onToggle}
      title={enabled ? 'Voice narration ON — click to disable' : 'Voice narration OFF — click to enable'}
    >
      {/* Animated pill switch */}
      <div className="vtb-track">
        <div className="vtb-thumb" />
      </div>
      <span className="voice-toggle-icon">{enabled ? '🔊' : '🔇'}</span>
      <span className="voice-toggle-label">VOICE: {enabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}
