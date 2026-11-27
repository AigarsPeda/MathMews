import { FractionNotation } from '@/components/puzzle/fraction/FractionNotation';
import { Caption } from '@/components/puzzle/kit/Focus';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

export function StackedEquation({ value, textStyle }: { value: string; textStyle?: StyleProp<TextStyle> }) {
  return <View style={styles.equation}>
    {value.split(/ (\+|=|×|<|>|−) /).map((term, index) => {
      const fraction = /^(\d+)\/(\d+)$/.exec(term);
      return fraction ? <FractionNotation key={index} numerator={fraction[1]} denominator={fraction[2]} />
        : <Caption key={index} strong style={textStyle}>{term}</Caption>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  equation: { alignSelf: 'stretch', maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 4, alignItems: 'center', justifyContent: 'center' },
});
