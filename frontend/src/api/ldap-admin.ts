import axios from './axios';

export const ldapAdminApi = {
  // User operations
  getAllUsers: () => axios.get('/ldap-admin/users'),
  createUser: (userData: any) => axios.post('/ldap-admin/users', userData),
  updateUser: (dn: string, changes: any) => axios.put(`/ldap-admin/users/${encodeURIComponent(dn)}`, changes),
  deleteUser: (dn: string) => axios.delete(`/ldap-admin/users/${encodeURIComponent(dn)}`),

  // Group operations
  getAllGroups: () => axios.get('/ldap-admin/groups'),
  createGroup: (groupData: any) => axios.post('/ldap-admin/groups', groupData),
  updateGroup: (dn: string, changes: any) => axios.put(`/ldap-admin/groups/${encodeURIComponent(dn)}`, changes),
  deleteGroup: (dn: string) => axios.delete(`/ldap-admin/groups/${encodeURIComponent(dn)}`),

  // Group membership operations
  addUserToGroup: (groupDn: string, userDn: string) =>
    axios.post('/ldap-admin/groups/add-member', { groupDn, userDn }),
  removeUserFromGroup: (groupDn: string, userDn: string) =>
    axios.post('/ldap-admin/groups/remove-member', { groupDn, userDn }),
};
