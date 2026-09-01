import Link from "next/link";

export function ModuloPendienteComercial({ titulo, descripcion, agentes, fuente }: { titulo: string; descripcion: string; agentes: string[]; fuente: string }) {
  return <main className="b18-modulo-pendiente">
    <p>Ventas · configuración comercial</p>
    <h1>{titulo}</h1>
    <section>
      <div className="b18-modulo-marca">B<span>18</span></div>
      <article>
        <p>Dashboard integral · fuente pendiente</p>
        <h2>{descripcion}</h2>
        <strong>Antes de calcular</strong>
        <span>{fuente}</span>
      </article>
      <div className="b18-modulo-agentes">{agentes.map((agente, indice) => <div key={agente}><b>{String(indice + 1).padStart(2, "0")}</b><span>{agente}</span><small>Sin cifra hasta conectar la fuente</small></div>)}</div>
    </section>
    <Link href="/ventas">Volver al radar comercial →</Link>
  </main>;
}
