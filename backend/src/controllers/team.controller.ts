import { Request, Response } from 'express';
import teamService from '../services/team.service';

export const getAllTeams = async (req: Request, res: Response) => {
  try {
    const teams = await teamService.getAllTeams();
    res.json(teams);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTeamById = async (req: Request, res: Response) => {
  try {
    const team = await teamService.getTeamById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTeam = async (req: Request, res: Response) => {
  try {
    const { name, ldapDn, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const team = await teamService.createTeam({
      name,
      ldapDn,
      description,
    });

    res.status(201).json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTeam = async (req: Request, res: Response) => {
  try {
    const { name, ldapDn, description, isActive } = req.body;

    const team = await teamService.updateTeam(req.params.id, {
      name,
      ldapDn,
      description,
      isActive,
    });

    res.json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTeam = async (req: Request, res: Response) => {
  try {
    await teamService.deleteTeam(req.params.id);
    res.json({ message: 'Team deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const syncFromLDAP = async (req: Request, res: Response) => {
  try {
    const results = await teamService.syncFromLDAP();
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const members = await teamService.getTeamMembers(id);
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
