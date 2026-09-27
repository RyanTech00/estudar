// Who is signed in, relative to this install:
//   owner  — full app (the email given in Configurar; or anyone, on installs with no owner set)
//   viewer — follows one owner's plan and progress, read-only
//   none   — has an account but no access (e.g. created while sign-ups were open)
// The database rules and the Worker enforce this; the app only mirrors it on screen.

// viewerOf: owner id found in the viewers table for this email (or null).
// me: /api/me answer, { owner, ownerConfigured }, or null when the server couldn't be asked.
export function resolveRole({ viewerOf = null, me = null } = {}) {
  if (viewerOf) return { role: 'viewer', ownerId: viewerOf };
  if (!me || !me.ownerConfigured || me.owner) return { role: 'owner', ownerId: null };
  return { role: 'none', ownerId: null };
}

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Worker side. The owner is pinned by account id when known (an id can't change hands), else by email.
// With no owner set (older installs), every signed-in user owns their own data, as before.
export function isOwner({ ownerId = '', ownerEmail = '' } = {}, user) {
  if (!user?.id) return false;
  if (ownerId) return user.id === ownerId;
  return isOwnerEmail(ownerEmail, user.email);
}

export function isOwnerEmail(ownerEmail, email) {
  const owner = normalizeEmail(ownerEmail);
  return !owner || normalizeEmail(email) === owner;
}
