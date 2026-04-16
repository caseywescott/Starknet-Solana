import { MintStatusClient } from "./MintStatusClient";

export default function MintPage({ params }: { params: { compositionId: string } }) {
  return <MintStatusClient compositionId={params.compositionId} />;
}
