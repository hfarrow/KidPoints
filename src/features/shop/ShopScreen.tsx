import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { MainScreenActions } from '../shell/MainScreenActions';

export function ShopScreen() {
  return (
    <ScreenScaffold>
      <ScreenHeader actions={<MainScreenActions />} title="Shop" />
    </ScreenScaffold>
  );
}
