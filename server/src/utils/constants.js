// Roles per SRS section 7. Students self-register; the rest are assigned.
const ROLES = {
  STUDENT: 'student',
  MENTOR: 'mentor',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
};

const ROLE_VALUES = Object.values(ROLES);

// Roles a user is allowed to pick at registration time.
const SELF_ASSIGNABLE_ROLES = [ROLES.STUDENT, ROLES.MENTOR];

module.exports = { ROLES, ROLE_VALUES, SELF_ASSIGNABLE_ROLES };
