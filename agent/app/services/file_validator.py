"""
File Validator Service - Security validation for uploaded files.
Validates file types using magic numbers and performs basic malware scanning.
"""

import logging
import math
import magic
from typing import Dict, List
from collections import Counter
from pathlib import Path

logger = logging.getLogger(__name__)


class FileValidator:
    """Validate uploaded files for security."""

    # Magic numbers for allowed file types
    ALLOWED_MIME_TYPES = {
        'application/pdf': ['pdf'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
        'application/msword': ['doc'],
        'text/csv': ['csv'],
        'text/plain': ['txt'],
        'image/png': ['png'],
        'image/jpeg': ['jpg', 'jpeg'],
    }

    @staticmethod
    def validate_file_type(file_path: str, claimed_ext: str) -> bool:
        """
        Validate file type using magic numbers, not just extension.

        Args:
            file_path: Path to the file to validate
            claimed_ext: The file extension claimed (from filename)

        Returns:
            True if file type is valid and matches extension
        """
        try:
            mime = magic.from_file(file_path, mime=True)

            # Check if MIME type is allowed
            if mime not in FileValidator.ALLOWED_MIME_TYPES:
                logger.warning(f"Disallowed MIME type: {mime} for file {file_path}")
                return False

            # Check if extension matches MIME type
            allowed_exts = FileValidator.ALLOWED_MIME_TYPES[mime]
            if claimed_ext not in allowed_exts:
                logger.warning(
                    f"Extension mismatch: claimed '{claimed_ext}' but detected '{mime}' "
                    f"(expected {allowed_exts})"
                )
                return False

            logger.info(f"File validation passed: {file_path} ({mime})")
            return True

        except Exception as e:
            logger.error(f"File validation error: {e}")
            return False

    @staticmethod
    def scan_for_malware(file_path: str, max_bytes: int = 102400) -> bool:
        """
        Basic malware scanning using entropy analysis.

        High entropy can indicate encryption, compression, or malware.
        This is a basic check - for production, integrate with ClamAV or similar.

        Args:
            file_path: Path to the file to scan
            max_bytes: Maximum bytes to read for entropy check (default 100KB)

        Returns:
            True if file passes scan, False if suspicious
        """
        try:
            with open(file_path, 'rb') as f:
                data = f.read(max_bytes)

            if not data:
                logger.warning(f"Empty file: {file_path}")
                return True  # Empty file is not malware

            # Calculate Shannon entropy
            counter = Counter(data)
            entropy = -sum(
                (count / len(data)) * math.log2(count / len(data))
                for count in counter.values()
            )

            # Entropy > 7.5 might indicate encryption/packing
            # This is a heuristic - legitimate compressed files may also have high entropy
            if entropy > 7.5:
                logger.warning(
                    f"High entropy file detected: {file_path} (entropy: {entropy:.2f}). "
                    f"This might indicate encryption or compression."
                )
                # For text files, high entropy is more suspicious
                if file_path.lower().endswith(('.txt', '.csv')):
                    logger.error(f"Suspiciously high entropy for text file: {file_path}")
                    return False

            logger.info(f"Malware scan passed: {file_path} (entropy: {entropy:.2f})")
            return True

        except Exception as e:
            logger.error(f"Malware scan error: {e}")
            # Fail closed - reject file if scan fails
            return False

    @staticmethod
    def validate_file_size(file_path: str, max_size_bytes: int) -> bool:
        """
        Validate file size.

        Args:
            file_path: Path to the file
            max_size_bytes: Maximum allowed size in bytes

        Returns:
            True if file size is within limit
        """
        try:
            file_size = Path(file_path).stat().st_size
            if file_size > max_size_bytes:
                logger.warning(
                    f"File too large: {file_path} ({file_size} bytes, max: {max_size_bytes})"
                )
                return False
            return True
        except Exception as e:
            logger.error(f"File size validation error: {e}")
            return False

    @staticmethod
    def validate_all(file_path: str, claimed_ext: str, max_size_bytes: int) -> Dict[str, any]:
        """
        Run all validation checks on a file.

        Args:
            file_path: Path to the file
            claimed_ext: The file extension claimed
            max_size_bytes: Maximum allowed file size

        Returns:
            Dict with validation results: {
                'valid': bool,
                'error': str or None,
                'checks': {
                    'file_type': bool,
                    'malware_scan': bool,
                    'file_size': bool
                }
            }
        """
        results = {
            'valid': True,
            'error': None,
            'checks': {}
        }

        # Check file size first (fastest check)
        size_valid = FileValidator.validate_file_size(file_path, max_size_bytes)
        results['checks']['file_size'] = size_valid
        if not size_valid:
            results['valid'] = False
            results['error'] = f"File too large. Max size: {max_size_bytes / 1024 / 1024}MB"
            return results

        # Check file type
        type_valid = FileValidator.validate_file_type(file_path, claimed_ext)
        results['checks']['file_type'] = type_valid
        if not type_valid:
            results['valid'] = False
            results['error'] = f"File content doesn't match extension '{claimed_ext}'"
            return results

        # Scan for malware
        malware_scan = FileValidator.scan_for_malware(file_path)
        results['checks']['malware_scan'] = malware_scan
        if not malware_scan:
            results['valid'] = False
            results['error'] = "File failed security scan. Please upload a different file."
            return results

        logger.info(f"All validation checks passed for: {file_path}")
        return results


# Singleton instance
file_validator = FileValidator()
