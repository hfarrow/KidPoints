import { useRef } from 'react';
import type { ScrollView } from 'react-native';

import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { TransactionsScreenContent } from './TransactionsScreenContent';

export function TransactionsScreen() {
  const scrollViewRef = useRef<ScrollView | null>(null);

  return (
    <ScreenScaffold footer={<ScreenBackFooter />} scrollViewRef={scrollViewRef}>
      <ScreenHeader title="Transactions" />
      <TransactionsScreenContent
        onRequestScroll={(y) => {
          scrollViewRef.current?.scrollTo({
            animated: true,
            y,
          });
        }}
      />
    </ScreenScaffold>
  );
}
