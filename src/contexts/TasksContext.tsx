"use client";

import React, { createContext, useContext, useState } from "react";
import { MOCK_TASKS, MOCK_GENERAL_TASKS } from "@/data/mock";
import type { Task } from "@/types";

interface AssignParams {
  workerId: string;
  farmName: string;
  date: string;
}

interface TasksContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  generalTasks: Task[];
  setGeneralTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  assignUnassignedTask: (taskId: string, params: AssignParams) => void;
  /** Siguiente número de tarea (0001, 0002, ...) para nuevas tareas. */
  getNextTaskNumber: () => number;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [generalTasks, setGeneralTasks] = useState<Task[]>(MOCK_GENERAL_TASKS);

  const assignUnassignedTask = (taskId: string, params: AssignParams) => {
    const { workerId, farmName, date } = params;
    const task = generalTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assigned: Task = {
      ...task,
      workerId,
      farmName: farmName || task.farmName,
      date,
    };
    setTasks((t) => [...t, assigned]);
    setGeneralTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const getNextTaskNumber = () => {
    const maxTasks = Math.max(0, ...tasks.map((t) => t.taskNumber ?? 0));
    const maxGeneral = Math.max(0, ...generalTasks.map((t) => t.taskNumber ?? 0));
    return Math.max(maxTasks, maxGeneral) + 1;
  };

  return (
    <TasksContext.Provider
      value={{
        tasks,
        setTasks,
        generalTasks,
        setGeneralTasks,
        assignUnassignedTask,
        getNextTaskNumber,
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (ctx === undefined) {
    throw new Error("useTasks must be used within TasksProvider");
  }
  return ctx;
}
