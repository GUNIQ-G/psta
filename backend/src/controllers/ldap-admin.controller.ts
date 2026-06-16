import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ldapService from '../config/ldap';
import appLogger, { errorLogger, ldapLogger } from '../config/logger';

// Get all LDAP users
export const getAllLdapUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await ldapService.getAllUsers();
    res.json(users);
  } catch (error: any) {
    ldapLogger.error('Error fetching LDAP users', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all LDAP groups
export const getAllLdapGroups = async (req: AuthRequest, res: Response) => {
  try {
    const groups = await ldapService.getGroups();
    res.json(groups);
  } catch (error: any) {
    ldapLogger.error('Error fetching LDAP groups', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new LDAP user
export const createLdapUser = async (req: AuthRequest, res: Response) => {
  try {
    const userData = req.body;

    // Validate required fields
    if (!userData.uid || !userData.cn || !userData.sn || !userData.password) {
      return res.status(400).json({
        error: 'Missing required fields: uid, cn, sn, password are required'
      });
    }

    await ldapService.createUser(userData);
    res.status(201).json({ message: 'User created successfully' });
  } catch (error: any) {
    ldapLogger.error('Error creating LDAP user', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update an LDAP user
export const updateLdapUser = async (req: AuthRequest, res: Response) => {
  try {
    const { dn } = req.params;
    const changes = req.body;

    await ldapService.updateUser(dn, changes);
    res.json({ message: 'User updated successfully' });
  } catch (error: any) {
    ldapLogger.error('Error updating LDAP user', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete an LDAP user
export const deleteLdapUser = async (req: AuthRequest, res: Response) => {
  try {
    const { dn } = req.params;

    await ldapService.deleteUser(dn);
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    ldapLogger.error('Error deleting LDAP user', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new LDAP group
export const createLdapGroup = async (req: AuthRequest, res: Response) => {
  try {
    const groupData = req.body;

    // Validate required fields
    if (!groupData.name) {
      return res.status(400).json({
        error: 'Missing required field: name is required'
      });
    }

    await ldapService.createGroup(groupData);
    res.status(201).json({ message: 'Group created successfully' });
  } catch (error: any) {
    ldapLogger.error('Error creating LDAP group', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update an LDAP group
export const updateLdapGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { dn } = req.params;
    const changes = req.body;

    await ldapService.updateGroup(dn, changes);
    res.json({ message: 'Group updated successfully' });
  } catch (error: any) {
    ldapLogger.error('Error updating LDAP group', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete an LDAP group
export const deleteLdapGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { dn } = req.params;

    await ldapService.deleteGroup(dn);
    res.json({ message: 'Group deleted successfully' });
  } catch (error: any) {
    ldapLogger.error('Error deleting LDAP group', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add user to group
export const addUserToGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { groupDn, userDn } = req.body;

    if (!groupDn || !userDn) {
      return res.status(400).json({
        error: 'Missing required fields: groupDn and userDn are required'
      });
    }

    await ldapService.addUserToGroup(groupDn, userDn);
    res.json({ message: 'User added to group successfully' });
  } catch (error: any) {
    ldapLogger.error('Error adding user to group', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove user from group
export const removeUserFromGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { groupDn, userDn } = req.body;

    if (!groupDn || !userDn) {
      return res.status(400).json({
        error: 'Missing required fields: groupDn and userDn are required'
      });
    }

    await ldapService.removeUserFromGroup(groupDn, userDn);
    res.json({ message: 'User removed from group successfully' });
  } catch (error: any) {
    ldapLogger.error('Error removing user from group', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
