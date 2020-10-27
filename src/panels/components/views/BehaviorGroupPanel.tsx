import React, { useEffect, useState } from "react";

import { BehaviorGroup } from "../../../ttf/core_pb";

import ArtifactInspector from "../inspectors/ArtifactInspector";
import ToolBoxTitle from "../ToolBoxTitle";

import { artifactPanelBaseEvents } from "../../artifactPanelBaseEvents";
import { behaviorGroupPanelEvents } from "../../behaviorGroupPanelEvents";
import { TaxonomyAsObjects } from "../../taxonomyAsObjects";

type Props = {
  postMessage: (message: any) => void;
};

export default function BehaviorGroupPanel({ postMessage }: Props) {
  const [taxonomy, setTaxonomy] = useState<TaxonomyAsObjects | null>(null);
  const [artifact, setArtifact] = useState<BehaviorGroup.AsObject | null>(null);
  const [editMode, setEditMode] = useState(false);

  const handleMessage = (message: any) => {
    if (message.taxonomy) {
      console.log("Received taxonomy update", message.taxonomy);
      setTaxonomy(message.taxonomy);
    }
    if (message.artifact) {
      console.log("Received artifact update", message.artifact);
      setArtifact(message.artifact);
    }
  };

  useEffect(() => {
    window.addEventListener("message", (msg) => handleMessage(msg.data));
    postMessage({ e: artifactPanelBaseEvents.Init });
  }, []);

  if (artifact && taxonomy) {
    return (
      <>
        <ToolBoxTitle
          title={artifact.artifact?.name || ""}
          editMode={editMode}
          setEditMode={setEditMode}
          onExport={() => postMessage({ e: artifactPanelBaseEvents.Export })}
          onRename={
            editMode
              ? () => postMessage({ e: artifactPanelBaseEvents.Rename })
              : undefined
          }
        />
        <div style={{ margin: "var(--padding)", padding: "var(--padding)" }}>
          <ArtifactInspector
            taxonomy={taxonomy}
            artifact={artifact}
            artifactType="behavior-group"
            postMessage={postMessage}
            update={
              editMode
                ? (update) =>
                    postMessage({ e: artifactPanelBaseEvents.Update, update })
                : undefined
            }
          />
        </div>
      </>
    );
  } else {
    return <>Loading&hellip;</>;
  }
}
