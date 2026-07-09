import { Router } from "express";
import { getAllSkills } from "../services/taskService";

export const skillsRouter = Router();

// GET /api/skills - list all skills
skillsRouter.get("/", async (_req, res) => {
  try {
    const skills = await getAllSkills();
    res.json(skills);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch skills" });
  }
});
