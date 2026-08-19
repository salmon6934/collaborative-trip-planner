'use client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemberWithStatus {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  role: string;
  isOnline: boolean;
  isEditing: boolean;
}

interface MembersPanelProps {
  members: MemberWithStatus[];
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const avatarColors = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-teal-500',
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

// ─── MembersPanel Component ──────────────────────────────────────────────────

/**
 * Slide-in panel from the right showing all trip members with online/offline status.
 * Online members get a green ring, offline members get a grey ring.
 */
export function MembersPanel({ members, isOpen, onClose }: MembersPanelProps) {
  const onlineMembers = members.filter((m) => m.isOnline);
  const offlineMembers = members.filter((m) => !m.isOnline);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-80 transform bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Members</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close members panel"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Members list */}
        <div className="overflow-y-auto p-4" style={{ height: 'calc(100% - 65px)' }}>
          {/* Online section */}
          {onlineMembers.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Online — {onlineMembers.length}
              </p>
              <div className="space-y-3">
                {onlineMembers.map((member) => (
                  <MemberRow key={member.userId} member={member} />
                ))}
              </div>
            </div>
          )}

          {/* Offline section */}
          {offlineMembers.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Offline — {offlineMembers.length}
              </p>
              <div className="space-y-3">
                {offlineMembers.map((member) => (
                  <MemberRow key={member.userId} member={member} />
                ))}
              </div>
            </div>
          )}

          {members.length === 0 && (
            <p className="text-center text-sm text-gray-400">No members found</p>
          )}
        </div>
      </div>
    </>
  );
}

// ─── MemberRow Component ─────────────────────────────────────────────────────

function MemberRow({ member }: { member: MemberWithStatus }) {
  const ringColor = member.isOnline ? 'ring-green-400' : 'ring-gray-300';

  // Determine status text
  let statusText: string;
  let statusColor: string;
  if (!member.isOnline) {
    statusText = 'offline';
    statusColor = 'text-gray-400';
  } else if (member.isEditing) {
    statusText = 'tweaking things';
    statusColor = 'text-amber-500';
  } else {
    statusText = 'online';
    statusColor = 'text-green-500';
  }

  return (
    <div className="flex items-center gap-3">
      {/* Avatar with online/offline ring */}
      <div
        className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ring-2 ${ringColor} text-xs font-semibold text-white ${getAvatarColor(member.userId)}`}
      >
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={member.userName}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          getInitial(member.userName)
        )}
      </div>

      {/* Name + status */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{member.userName}</p>
        <p className={`text-xs ${statusColor}`}>{statusText}</p>
      </div>

      {/* Online/offline dot indicator */}
      <span
        className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
          member.isOnline ? 'bg-green-400' : 'bg-gray-300'
        }`}
      />
    </div>
  );
}

// ─── Members Toggle Button ───────────────────────────────────────────────────

interface MembersButtonProps {
  onlineCount: number;
  onClick: () => void;
}

/**
 * Button to toggle the members panel. Shows a people icon + online count.
 */
export function MembersButton({ onlineCount, onClick }: MembersButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 transition"
      aria-label="Toggle members panel"
      title="Show members"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      {onlineCount > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[11px] font-semibold text-green-700">
          {onlineCount}
        </span>
      )}
    </button>
  );
}
