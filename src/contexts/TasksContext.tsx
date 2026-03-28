"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
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

  const assignUnassignedTask = useCallback((taskId: string, params: AssignParams) => {
    const { workerId, farmName, date } = params;
    setGeneralTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task) return prev;
      const assigned: Task = {
        ...task,
        workerId,
        farmName: farmName || task.farmName,
        date,
      };
      setTasks((t) => [...t, assigned]);
      return prev.filter((t) => t.id !== taskId);
    });
  }, []);

  const getNextTaskNumber = useCallback(() => {
    const maxTasks = Math.max(0, ...tasks.map((t) => t.taskNumber ?? 0));
    const maxGeneral = Math.max(0, ...generalTasks.map((t) => t.taskNumber ?? 0));
    return Math.max(maxTasks, maxGeneral) + 1;
  }, [tasks, generalTasks]);

  const ctxValue = useMemo<TasksContextType>(
    () => ({
      tasks,
      setTasks,
      generalTasks,
      setGeneralTasks,
      assignUnassignedTask,
      getNextTaskNumber,
    }),
    [tasks, generalTasks, assignUnassignedTask, getNextTaskNumber],
  );

  return (
    <TasksContext.Provider value={ctxValue}>
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
