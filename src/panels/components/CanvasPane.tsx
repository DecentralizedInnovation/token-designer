import React from "react";

type Props = {
  left: string;
  right: string;
  children: any;
  formula?: string;
  formulaDescription?: string;
  definitionName?: string;
  onExport: () => void;
  setFormulaDescription?: (description: string) => void;
  setDefinitionName?: (name: string) => void;
};

export default function CanvasPane({
  left,
  right,
  formula,
  children,
  formulaDescription,
  definitionName,
  onExport,
  setFormulaDescription,
  setDefinitionName,
}: Props) {
  const style: React.CSSProperties = {
    position: "fixed",
    top: 0,
    bottom: 0,
    left,
    right,
  };
  const formulaStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "calc(2*var(--padding))",
    right: "calc(2*var(--padding))",
    fontSize: "2em",
  };
  const formulaDescriptionStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "calc(2*var(--padding))",
    left: "calc(2*var(--padding))",
    width: "50%",
    border: "var(--borderWidth) solid var(--vscode-editor-background)",
    backgroundColor: "var(--vscode-editor-background)",
    color: "var(--vscode-editor-foreground)",
    fontFamily: "sans-serif",
    height: "3em",
    fontSize: "1.25em",
  };
  const definitionNameStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(2*var(--padding))",
    left: "calc(2*var(--padding))",
    width: "50%",
    border: "var(--borderWidth) solid var(--vscode-editor-background)",
    backgroundColor: "var(--vscode-editor-background)",
    color: "var(--vscode-editor-foreground)",
    fontFamily: "sans-serif",
    fontSize: "2em",
  };
  const exportLinkStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(1*var(--padding))",
    right: "calc(3*var(--padding))",
    cursor: "pointer",
    color: "var(--vscode-sideBarTitle-foreground)",
    textDecoration: "underline",
    fontSize: "1.2em",
  };
  return (
    <div style={style}>
      {children}
      <h1 style={exportLinkStyle} onClick={onExport}>
        Export
      </h1>
      {definitionName && (
        <input
          type="text"
          style={definitionNameStyle}
          defaultValue={definitionName}
          onBlur={
            setDefinitionName
              ? (ev) => setDefinitionName(ev.target.value)
              : undefined
          }
        />
      )}
      {formulaDescription && (
        <textarea
          style={formulaDescriptionStyle}
          defaultValue={formulaDescription}
          onBlur={
            setFormulaDescription
              ? (ev) => setFormulaDescription(ev.target.value)
              : undefined
          }
        />
      )}
      {formula && <span style={formulaStyle}>{formula}</span>}
    </div>
  );
}
