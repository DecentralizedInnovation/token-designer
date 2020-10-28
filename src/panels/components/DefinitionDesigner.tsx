import React, { useState } from "react";

import {
  TemplateDefinition,
  PropertySet,
  BehaviorGroup,
  Behavior,
} from "../../ttf/core_pb";

import AnyArtifact from "./AnyArtifact";
import ArtifactType from "./ArtifactType";
import Canvas from "./Canvas";
import CanvasPane from "./CanvasPane";
import DefinitionInspector from "./inspectors/DefinitionInspector";
import { TaxonomyAsObjects } from "../taxonomyAsObjects";
import ToolPane from "./ToolPane";

type Props = {
  taxonomy: TaxonomyAsObjects;
  definition: TemplateDefinition.AsObject;
  onExport: () => void;
  setDefinitionName: (name: string) => void;
  setDefinitionProperty: (path: string, name: string) => void;
  loadFormula?: (tooling: string) => void;
};

export default function DefinitionDesigner({
  taxonomy,
  definition,
  onExport,
  setDefinitionName,
  setDefinitionProperty,
  loadFormula,
}: Props) {
  const [toolTip, setToolTip] = useState<AnyArtifact | null>(null);

  const [selectedArtifact, setSelectedArtifact] = useState<
    [AnyArtifact, ArtifactType] | undefined
  >(undefined);

  const tokenBase = taxonomy?.baseTokenTypes.find(
    (_) =>
      _.artifact?.artifactSymbol?.id === definition.tokenBase?.reference?.id
  );

  const propertySets = definition.propertySetsList
    .map((_) => _.reference?.id)
    .map((id) =>
      taxonomy?.propertySets.find((_) => _.artifact?.artifactSymbol?.id === id)
    )
    .filter((_) => !!_) as PropertySet.AsObject[];

  const behaviorGroups = definition.behaviorGroupsList
    .map((_) => _.reference?.id)
    .map((id) =>
      taxonomy?.behaviorGroups.find(
        (_) => _.artifact?.artifactSymbol?.id === id
      )
    )
    .filter((_) => !!_) as BehaviorGroup.AsObject[];

  const behaviors = definition.behaviorsList
    .map((_) => _.reference?.id)
    .map((id) =>
      taxonomy?.behaviors.find((_) => _.artifact?.artifactSymbol?.id === id)
    )
    .filter((_) => !!_) as Behavior.AsObject[];

  const rightPaneWidth = "35vw";

  return (
    <>
      <CanvasPane
        left="0"
        right={rightPaneWidth}
        definitionName={definition.artifact?.name}
        onExport={onExport}
        setDefinitionName={setDefinitionName}
      >
        <Canvas
          tokenBase={tokenBase}
          propertySets={propertySets}
          behaviorGroups={behaviorGroups}
          behaviors={behaviors}
          selectedArtifact={selectedArtifact}
          setSelectedArtifact={setSelectedArtifact}
          setToolTip={setToolTip}
        />
      </CanvasPane>
      <ToolPane position="right" width={rightPaneWidth}>
        <DefinitionInspector
          taxonomy={taxonomy}
          definition={definition}
          artifact={selectedArtifact ? selectedArtifact[0] : definition}
          artifactType={
            selectedArtifact ? selectedArtifact[1] : "template-definition"
          }
          setDefinitionProperty={setDefinitionProperty}
          loadFormula={loadFormula}
        />
      </ToolPane>
    </>
  );
}
