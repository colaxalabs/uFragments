pragma solidity 0.4.24;


/**
 * @title Various utilities useful for uint256.
 */
library UInt256Lib {

  uint256 private constant MAX_INT256 = ~(uint256(1) << 255);
    
  /**
   * @dev Safely converts a uint256 to an int256.
   */
  function toInt256(uint256 a) internal pure returns (int256) {
      assert(a <= MAX_INT256);
      return int256(a);
  }

  function getMaxInt256() public pure returns (uint256) {
      return MAX_INT256;
  }
}