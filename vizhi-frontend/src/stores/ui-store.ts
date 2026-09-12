import { create } from "zustand";

type UiState = {
  timeRange: "1h" | "24h" | "7d" | "30d";
  selectedAgentId: string;
  selectedModelId: string;
  setTimeRange: (range: UiState["timeRange"]) => void;
  setSelectedAgentId: (agentId: string) => void;
  setSelectedModelId: (modelId: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  timeRange: "24h",
  selectedAgentId: "all",
  selectedModelId: "all",
  setTimeRange: (timeRange) => set({ timeRange }),
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),
  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
}));
