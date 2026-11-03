import { HashRouter, Route, Routes } from 'react-router'
import { CampaignProvider, useCampaign } from './campaign'
import { Entities } from './screens/Entities'
import { EntitySheet } from './screens/EntitySheet'
import { Home } from './screens/Home'
import { Boards } from './screens/Boards'
import { Clues } from './screens/Clues'
import { Compendium, CompendiumThreat } from './screens/Compendium'
import { Files } from './screens/Files'
import { Help } from './screens/Help'
import { Library } from './screens/Library'
import { Scenes } from './screens/Scenes'
import { Session } from './screens/Session'
import { Settings } from './screens/Settings'
import { Texts } from './screens/Texts'
import { Trash } from './screens/Trash'
import { Timeline } from './screens/Timeline'
import { Shell } from './screens/Shell'

function Routed() {
  const { campaign } = useCampaign()
  if (!campaign) return <Library />
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="fichas" element={<Entities />} />
        <Route path="fichas/:kind" element={<Entities />} />
        <Route path="ficha/:id" element={<EntitySheet />} />
        <Route path="cenas" element={<Scenes />} />
        <Route path="cenas/:id" element={<Scenes />} />
        <Route path="linha-do-tempo" element={<Timeline />} />
        <Route path="pistas" element={<Clues />} />
        <Route path="quadros" element={<Boards />} />
        <Route path="quadros/:id" element={<Boards />} />
        <Route path="textos" element={<Texts />} />
        <Route path="arquivos" element={<Files />} />
        <Route path="textos/:id" element={<Texts />} />
        <Route path="biblioteca" element={<Compendium />} />
        <Route path="biblioteca/ameaca/:id" element={<CompendiumThreat />} />
        <Route path="sessao" element={<Session />} />
        <Route path="lixeira" element={<Trash />} />
        <Route path="ajustes" element={<Settings />} />
        <Route path="ajuda" element={<Help />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <CampaignProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </CampaignProvider>
  )
}
