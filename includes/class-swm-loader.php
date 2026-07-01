<?php
namespace WildMaps;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Loader {
	public static function require_file( $relative_path ) {
		$relative_path = ltrim( (string) $relative_path, '/' );
		$file = SWM_PATH . $relative_path;
		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}

	public static function require_files( $files ) {
		foreach ( (array) $files as $file ) {
			self::require_file( $file );
		}
	}
}
