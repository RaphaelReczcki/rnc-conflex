// Logo da Conflex: colorida no tema claro, branca no escuro (troca via CSS).
export function Logo({ className = "" }: { className?: string }) {
  return (
    <>
      <img className={`logo-claro ${className}`} src="/marca/logo-conflex.png" alt="Conflex assessoria contábil" width={727} height={214} />
      <img className={`logo-escuro ${className}`} src="/marca/logo-conflex-branco.png" alt="Conflex assessoria contábil" width={727} height={214} />
    </>
  );
}
