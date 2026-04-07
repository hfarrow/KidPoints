import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';

export function ShopScreen() {
  return (
    <ScreenScaffold>
      <ScreenHeader actions={<MainScreenActions />} title="Shop" />
    </ScreenScaffold>
  );
}
