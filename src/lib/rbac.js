export function isAdmin(session) {
  return session?.user?.role === 'ADMIN';
}

export function isStaff(session) {
  return session?.user?.role === 'STAFF';
}
