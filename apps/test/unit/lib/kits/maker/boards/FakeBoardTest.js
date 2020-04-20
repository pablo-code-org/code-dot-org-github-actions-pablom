import {itImplementsTheMakerBoardInterface} from './MakerBoardTest';
import FakeBoard from '@cdo/apps/lib/kits/maker/boards/FakeBoard';
import {expect} from '../../../../../util/reconfiguredChai';

describe('FakeBoard', () => {
  itImplementsTheMakerBoardInterface(FakeBoard);

  describe(`boardConnected()`, () => {
    it('always returns false', () => {
      const board = new FakeBoard();
      expect(board.boardConnected()).to.be.false;
      return board.connect().then(() => {
        expect(board.boardConnected()).to.be.false;
        board.destroy();
        expect(board.boardConnected()).to.be.false;
      });
    });
  });
});
