import { getKeyboardModalFrameStyle } from '../../src/components/KeyboardModalFrame';

describe('KeyboardModalFrame', () => {
  it('centers the modal when the keyboard is closed', () => {
    expect(getKeyboardModalFrameStyle(0, false)).toEqual({
      justifyContent: 'center',
      paddingBottom: 18,
    });
  });

  it('positions the modal above the keyboard when it is open', () => {
    expect(getKeyboardModalFrameStyle(240, true)).toEqual({
      justifyContent: 'flex-end',
      paddingBottom: 250,
    });
  });

  it('keeps a bottom-placed modal near the screen edge before the keyboard opens', () => {
    expect(getKeyboardModalFrameStyle(0, true)).toEqual({
      justifyContent: 'flex-end',
      paddingBottom: 18,
    });
  });
});
