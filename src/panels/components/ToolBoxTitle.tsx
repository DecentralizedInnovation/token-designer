import React from "react";

import EditLink from "./links/EditLink";

type Props = {
  title: string;
  editMode?: boolean;
  onExport?: () => void;
  onRename?: () => void;
  setEditMode?: (editMode: boolean) => void;
};

export default function ToolBoxTitle({
  title,
  editMode,
  onExport,
  onRename,
  setEditMode,
}: Props) {
  const style: React.CSSProperties = {
    backgroundColor: "var(--vscode-sideBarSectionHeader-background)",
    color: "var(--vscode-sideBarTitle-foreground)",
    border:
      "var(--borderWidth) solid var(--vscode-sideBarSectionHeader-border)",
    margin: "var(--padding)",
    padding: "var(--padding)",
    fontSize: "1.2em",
  };
  return (
    <h1 style={style}>
      {title}
      {!!onRename && <EditLink onClick={onRename} />}
      {!!setEditMode && (
        <span
          style={{
            float: "right",
            cursor: "pointer",
            textDecoration: "underline",
            marginRight: 5,
          }}
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? "Done editing" : "Make changes"}
        </span>
      )}
      {!!onExport && !editMode && (
        <span
          style={{
            float: "right",
            marginRight: 5,
          }}
        >
          <span
            style={{
              cursor: "pointer",
              textDecoration: "underline",
              marginRight: 5,
            }}
            onClick={onExport}
          >
            Export
          </span>
          {setEditMode ? " | " : ""}
        </span>
      )}
    </h1>
  );
}
