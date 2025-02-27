import { StepsService } from '@kaoto/services';
import { IIntegration, IStepProps, IViewProps } from '@kaoto/types';
import { setDeepValue } from '@kaoto/utils';
import isEqual from 'lodash.isequal';
import { temporal } from 'zundo';
import { create } from 'zustand';
import { useNestedStepsStore } from './nestedStepsStore';
import { initDsl, initialSettings } from './settingsStore';

export interface IIntegrationJsonStore {
  appendStep: (newStep: IStepProps) => void;
  deleteBranchStep: (newRootStep: IStepProps, rootStepIndex: number) => void;
  deleteIntegration: () => void;
  deleteStep: (index: number) => void;
  deleteSteps: () => void;
  insertStep: (newStep: IStepProps, insertIndex: number) => void;
  integrationJson: IIntegration;
  prependStep: (currentStepIdx: number, newStep: IStepProps) => void;
  replaceBranchParentStep: (
    newParentStep: IStepProps,
    pathToParentStep: string[] | undefined
  ) => void;
  replaceStep: (newStep: IStepProps, oldStepIndex?: number) => void;
  updateIntegration: (newInt: IIntegration) => void;
  updateViews: (views: IViewProps[]) => void;
  views: IViewProps[];
}

export const integrationJsonInitialState: Pick<IIntegrationJsonStore, 'integrationJson' | 'views'>   = {
  integrationJson: {
    id: `${initDsl.name}-1`,
    dsl: initDsl.name,
    metadata: { name: initialSettings.name, namespace: initialSettings.namespace },
    steps: [],
    params: [],
  },
  views: [],
};

export const useIntegrationJsonStore = create<IIntegrationJsonStore>()(
  temporal(
    (set, get) => ({
      ...integrationJsonInitialState,
      appendStep: (newStep) => {
        set((state) => {
          let newSteps = state.integrationJson.steps.slice();
          // manually generate UUID for the new step
          newStep.UUID = `${newStep.name}-${newSteps.length}`;
          newSteps.push(newStep);
          return {
            integrationJson: {
              ...state.integrationJson,
              steps: newSteps,
            },
          };
        });
      },
      deleteIntegration: () => set(integrationJsonInitialState),
      deleteBranchStep: (newRootStep: IStepProps, rootStepIndex: number) => {
        let newSteps = get().integrationJson.steps.slice();
        // replacing the root step of a deeply nested step
        newSteps[rootStepIndex] = newRootStep;

        const stepsWithNewUuids = StepsService.regenerateUuids(newSteps, `${get().integrationJson.id}_`);
        const { updateSteps } = useNestedStepsStore.getState();
        updateSteps(StepsService.extractNestedSteps(stepsWithNewUuids));

        return set((state) => ({
          integrationJson: {
            ...state.integrationJson,
            steps: [...stepsWithNewUuids],
          },
        }));
      },
      deleteStep: (stepIdx) => {
        let stepsCopy = get().integrationJson.steps.slice();
        const updatedSteps = stepsCopy.filter((_step: IStepProps, idx: number) => idx !== stepIdx);
        const stepsWithNewUuids = StepsService.regenerateUuids(updatedSteps, `${get().integrationJson.id}_`);
        const updateSteps = useNestedStepsStore.getState().updateSteps;
        updateSteps(StepsService.extractNestedSteps(stepsWithNewUuids));
        set((state) => ({
          integrationJson: {
            ...state.integrationJson,
            steps: stepsWithNewUuids,
          },
        }));
      },
      deleteSteps: () => {
        set((state) => ({
          integrationJson: {
            ...state.integrationJson,
            steps: [],
          },
        }));
      },
      insertStep: (newStep, insertIndex) => {
        let steps = get().integrationJson.steps.slice();
        const stepsWithNewUuids = StepsService.regenerateUuids(
          StepsService.insertStep(steps, insertIndex, newStep),
          `${get().integrationJson.id}_`,
        );
        const updateSteps = useNestedStepsStore.getState().updateSteps;
        updateSteps(StepsService.extractNestedSteps(stepsWithNewUuids));

        set((state) => ({
          integrationJson: {
            ...state.integrationJson,
            steps: stepsWithNewUuids,
          },
        }));
      },
      prependStep: (currentStepIdx, newStep) => {
        set((state) => {
          return {
            integrationJson: {
              ...state.integrationJson,
              steps: [
                ...state.integrationJson.steps.slice(0, currentStepIdx),
                // manually generate UUID for the new step
                { ...newStep, UUID: `${newStep.name}-${state.integrationJson.steps.length}` },
                ...state.integrationJson.steps.slice(currentStepIdx),
              ],
            },
          };
        });
      },
      replaceBranchParentStep: (newParentStep, pathToParentStep) => {
        let stepsCopy = get().integrationJson.steps.slice();
        stepsCopy = setDeepValue(stepsCopy, pathToParentStep, newParentStep);

        const stepsWithNewUuids = StepsService.regenerateUuids(stepsCopy, `${get().integrationJson.id}_`);
        const { updateSteps } = useNestedStepsStore.getState();
        updateSteps(StepsService.extractNestedSteps(stepsWithNewUuids));

        return set((state) => ({
          integrationJson: {
            ...state.integrationJson,
            steps: [...stepsWithNewUuids],
          },
        }));
      },
      replaceStep: (newStep, oldStepIndex) => {
        let stepsCopy = get().integrationJson.steps.slice();
        if (oldStepIndex === undefined) {
          // replacing a slot step with no pre-existing step
          stepsCopy.unshift(newStep);
        } else {
          // replacing an existing step
          stepsCopy[oldStepIndex] = newStep;
        }

        const stepsWithNewUuids = StepsService.regenerateUuids(stepsCopy, `${get().integrationJson.id}_`);
        const { updateSteps } = useNestedStepsStore.getState();
        updateSteps(StepsService.extractNestedSteps(stepsWithNewUuids));

        return set((state) => ({
          integrationJson: {
            ...state.integrationJson,
            steps: [...stepsWithNewUuids],
          },
        }));
      },
      updateIntegration: (newInt: IIntegration) => {
        let newIntegration = { ...get().integrationJson, ...newInt };
        const uuidSteps = StepsService.regenerateUuids(newIntegration.steps, `${get().integrationJson.id}_`);
        const updateSteps = useNestedStepsStore.getState().updateSteps;
        updateSteps(StepsService.extractNestedSteps(uuidSteps));

        return set({ integrationJson: { ...newIntegration, steps: uuidSteps } });
      },
      updateViews: (views: IViewProps[]) => {
        set({ views });
      },
    }),
    {
      partialize: (state) => {
        const { integrationJson } = state;
        return { integrationJson };
      },
      equality: (a, b) => isEqual(a, b),
    }
  )
);
