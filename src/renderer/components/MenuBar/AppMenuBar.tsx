import { MenuBar } from './MenuBar';
import { FileMenu } from './FileMenu';
import { EditMenu } from './EditMenu';
import { ViewMenu } from './ViewMenu';

export function AppMenuBar() {
  return (
    <MenuBar>
      <FileMenu />
      <EditMenu />
      <ViewMenu />
    </MenuBar>
  );
}
