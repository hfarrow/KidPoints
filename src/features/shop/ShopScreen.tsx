import { MaterialCommunityIcons } from '@expo/vector-icons';

import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { useAppTheme } from '../theme/themeContext';

export function ShopScreen() {
  const { tokens } = useAppTheme();

  return (
    <ScreenScaffold>
      <ScreenHeader
        actions={<MainScreenActions />}
        title="Shop"
        titleIcon={
          <MaterialCommunityIcons
            color={tokens.textPrimary}
            name="shopping-outline"
            size={24}
          />
        }
      />
    </ScreenScaffold>
  );
}
