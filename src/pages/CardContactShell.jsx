import PageShell from '../components/PageShell/PageShell';
import CardLanding from './CardLanding';

export default function CardContactShell({ inline }) {
  return (
    <PageShell
      title="CONTACT"
      subtitle="NETWORKING // CARD"
      inline={inline}
      hideShellNav
    >
      <CardLanding />
    </PageShell>
  );
}
