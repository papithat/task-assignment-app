import { Router } from "express";
import { getAllDevelopers } from "../services/taskService";

export const developersRouter = Router();

// GET /api/developers - list all developers and their skills
developersRouter.get("/", async (_req, res) => {
  try {
    const developers = await getAllDevelopers();
    res.json(developers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch developers" });
  }
});
