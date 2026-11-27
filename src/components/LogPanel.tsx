interface LogPanelProps {
  log: string[];
}

export default function LogPanel({ log }: LogPanelProps) {
  return (
    <section className="panel log-panel">
      <div className="panel-title-row">
        <h2>战斗日志</h2>
        <span>{log.length}</span>
      </div>
      <div className="log-lines">
        {log.slice(0, 18).map((line, index) => (
          <div key={`${line}-${index}`} className={index === 0 ? "latest" : ""}>{line}</div>
        ))}
      </div>
    </section>
  );
}
