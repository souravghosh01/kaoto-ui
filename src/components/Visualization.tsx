import './Visualization.css';
import {
  DeleteButtonEdge,
  KaotoDrawer,
  PlusButtonEdge,
  StepErrorBoundary,
  VisualizationControls,
  VisualizationStep,
  VisualizationStepViews,
} from '@kaoto/components';
import { StepsService, VisualizationService } from '@kaoto/services';
import { useFlowsStore, useIntegrationJsonStore, useSettingsStore, useVisualizationStore } from '@kaoto/store';
import { IStepProps, IVizStepNode } from '@kaoto/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Viewport } from 'reactflow';
import { shallow } from 'zustand/shallow';

const Visualization = () => {
  // `nodes` is an array of UI-specific objects that represent
  // the Integration.Steps model visually, while `edges` connect them

  const defaultViewport = useRef<Viewport>({
    // 80/2 means half of the size of the icon so the placeholder icon can be centered
    x: window.innerWidth / 2 - 80 / 2,
    y: (window.innerHeight - 77) / 2 - 80 / 2,
    zoom: 1.2,
  });
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [selectedStep, setSelectedStep] = useState<IStepProps>({
    maxBranches: 0,
    minBranches: 0,
    name: '',
    type: '',
    UUID: '',
    integrationId: '',
  });

  const useMultipleFlows = useSettingsStore((state) => state.settings.useMultipleFlows);
  const { selectedStepUuid, setSelectedStepUuid } = useVisualizationStore(({ selectedStepUuid, setSelectedStepUuid }) => ({ selectedStepUuid, setSelectedStepUuid }), shallow);
  const { onNodesChange, onEdgesChange } = useVisualizationStore(({ onNodesChange, onEdgesChange }) => ({ onNodesChange, onEdgesChange }), shallow);
  const layout = useVisualizationStore((state) => state.layout);
  const nodes = useVisualizationStore((state) => state.nodes);
  const edges = useVisualizationStore((state) => state.edges);
  const integrationJson = useIntegrationJsonStore((state) => state.integrationJson);
  const flows = useFlowsStore((state) => state.flows);
  const visualizationService = useMemo(() => new VisualizationService(), []);
  const stepsService = useMemo(() => new StepsService(), []);

  /**
   * Check for changes to integrationJson,
   * which causes Visualization nodes to all be redrawn
   */
  useEffect(() => {
    stepsService.updateViews();
  }, [integrationJson, flows, stepsService]);

  /**
   * Check for changes to integrationJson to refresh the selected step's data.
   * This is usually caused because of code sync or changes through a step extension
   */
  useEffect(() => {
    if (!selectedStepUuid) {
      return;
    }

    const step = stepsService.findStepWithUUID(selectedStep.integrationId, selectedStepUuid);
    if (step) {
      setSelectedStep(step);
    } else {
      setSelectedStep({ maxBranches: 0, minBranches: 0, name: '', type: '', UUID: '', integrationId: '' });
      setSelectedStepUuid('');
      setIsPanelExpanded(false);
    }
  }, [integrationJson, flows, selectedStep.integrationId, selectedStepUuid, setSelectedStepUuid, stepsService]);

  const handleDeleteStep = useCallback((UUID?: string) => {
    if (!UUID) return;

    if (selectedStepUuid === UUID) {
      setIsPanelExpanded(false);
      setSelectedStep({ maxBranches: 0, minBranches: 0, name: '', type: '', UUID: '', integrationId: '' });
      setSelectedStepUuid('');
    }

    stepsService.deleteStep(UUID);
  }, [selectedStepUuid, setSelectedStepUuid, stepsService]);

  useEffect(() => {
    visualizationService.redrawDiagram(handleDeleteStep, true).catch((e) => console.error(e));
  }, [handleDeleteStep, integrationJson, flows, layout, useMultipleFlows, visualizationService]);

  const nodeTypes = useMemo(() => ({ step: VisualizationStep }), []);
  const edgeTypes = useMemo(
    () => ({
      delete: DeleteButtonEdge,
      insert: PlusButtonEdge,
    }),
    []
  );

  const onClosePanelClick = useCallback(() => {
    setIsPanelExpanded(false);
    setSelectedStepUuid('');
  }, [setSelectedStepUuid]);

  /**
   * Called when a catalog step is dragged over the visualization canvas
   * @param event
   */
  const onDragOver = (event: {
    preventDefault: () => void;
    dataTransfer: { dropEffect: string };
  }) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  /**
   * Called when a React Flow node is clicked
   * @param e
   * @param node
   */
  const onNodeClick = useCallback(
    (e: any, node: IVizStepNode) => {
      // here we check if it's a node or edge
      // workaround for https://github.com/wbkd/react-flow/issues/2202
      if (!e.target.classList.contains('stepNode__clickable')) return;

      if (!node.data.isPlaceholder) {
        const step = stepsService.findStepWithUUID(node.data.step.integrationId, node.data.step.UUID);
        if (step) {
          setSelectedStep(step);
          setSelectedStepUuid(step.UUID);
        }

        /** If the details panel is collapsed, we expanded for the user */
        if (!isPanelExpanded) setIsPanelExpanded(true);

        /**
         * If the details panel is already expanded and the step it's already
         * selected, we collapse it for the user */
        if (isPanelExpanded && selectedStepUuid === node.data.step.UUID) {
          setIsPanelExpanded(false);
          setSelectedStepUuid('');
        }
      }
    },
    [isPanelExpanded, selectedStepUuid, setSelectedStepUuid, stepsService]
  );

  /**
   * Handles Step View configuration changes
   * @param newValues
   */
  const saveConfig = useCallback((step: IStepProps, newValues: Record<string, unknown>) => {
    stepsService.updateStepParameters(step, newValues);
  }, [stepsService]);

  return (
    <StepErrorBoundary>
      {/* RIGHT DRAWER: STEP DETAIL & EXTENSIONS */}
      <KaotoDrawer
        isExpanded={isPanelExpanded}
        data-expanded={isPanelExpanded}
        isResizable
        dataTestId="kaoto-right-drawer"
        panelContent={
          <VisualizationStepViews
            step={selectedStep}
            isPanelExpanded={isPanelExpanded}
            onClosePanelClick={onClosePanelClick}
            saveConfig={saveConfig}
          />
        }
        position="right"
        id="right-resize-panel"
        defaultSize="500px"
        minSize="150px"
      >
        <div className="reactflow-wrapper" data-testid="react-flow-wrapper">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            defaultViewport={defaultViewport.current}
            edgeTypes={edgeTypes}
            nodeTypes={nodeTypes}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            snapToGrid
            snapGrid={[15, 15]}
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            className="panelCustom"
          >
            {/*<MiniMap nodeBorderRadius={2} className={'visualization__minimap'} />*/}
            <VisualizationControls />
            <Background color="#aaa" gap={16} />
          </ReactFlow>
        </div>
      </KaotoDrawer>
    </StepErrorBoundary>
  );
};

export { Visualization };
