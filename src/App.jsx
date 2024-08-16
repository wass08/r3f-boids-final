import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useAtom } from "jotai";
import { Leva } from "leva";
import { Suspense } from "react";
import { Experience } from "./components/Experience";
import { themeAtom, THEMES, UI } from "./components/UI";

function App() {
  const [theme] = useAtom(themeAtom);
  return (
    <>
      <Leva />
      <UI />
      <Loader />
      <Canvas shadows camera={{ position: [0, 1, 5], fov: 50 }}>
        <color attach="background" args={[THEMES[theme].skyColor]} />
        <fog attach="fog" args={[THEMES[theme].skyColor, 12, 20]} />
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </Canvas>
    </>
  );
}

export default App;
