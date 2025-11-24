import { MenuBar } from './MenuBar';
import { FileMenu } from './FileMenu';
import { EditMenu } from './EditMenu';

export function AppMenuBar() {
  return (
    <MenuBar>
      <FileMenu />
      <EditMenu />
    </MenuBar>
  );
}
