import SimulatorClient from './components/simulator-client';

export default function MarchingPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Marching Simulator</h1>
  <p className="text-sm text-gray-600">Pure engine with simple command input. Type commands like &quot;FALL IN&quot;, &quot;FORWARD MARCH&quot;, &quot;HALT&quot;, &quot;LEFT FACE&quot;, &quot;RIGHT FLANK&quot;, &quot;TO THE REAR&quot;.</p>
      <SimulatorClient />
    </div>
  );
}
