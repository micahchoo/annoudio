<?php
namespace Annoudio;

/** A check of the stack failed. The message is for the person who sees the form. */
class StackError extends \RuntimeException
{
    const BAD_ORIGIN = 'bad-origin';
    const NOT_CONFIGURED = 'not-configured';
    const BAD_RECORDING = 'bad-recording';
    const NOT_FOUND = 'not-found';
    const UNREACHABLE = 'unreachable';
    const UNEXPECTED = 'unexpected';

    public function __construct(public readonly string $kind, string $message)
    {
        parent::__construct($message);
    }
}
