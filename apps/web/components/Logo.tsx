/** Logo „Dächer“: drei gestapelte Dachlinien, oben grün. Farben aus der Marke, im Dunkelmodus hell. */
export function Zeichen({ groesse = 30 }: { groesse?: number }) {
  return (
    <svg className="zeichen" width={groesse} height={groesse} viewBox="0 0 44 44" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 36 22 26 36 36" className="z1" strokeWidth="5" />
      <path d="M8 26 22 16 36 26" className="z2" strokeWidth="5" />
      <path d="M8 16 22 6 36 16" className="z3" strokeWidth="5" />
    </svg>
  );
}
export function Logo({ groesse = 34 }: { groesse?: number }) {
  return <span className="logo"><Zeichen groesse={groesse} /><span className="wort"><b>high</b>stack</span></span>;
}
