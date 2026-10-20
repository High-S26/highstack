/** Logo: Wortmarke „highstack“, „stack“ in Orange. */
export function Logo({ zusatz = false }: { zusatz?: boolean; groesse?: number }) {
  return <span className="logo"><span className="wort">high<b>stack</b>{zusatz && <i>.si</i>}</span></span>;
}
