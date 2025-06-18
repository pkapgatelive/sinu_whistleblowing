import hmac
import hashlib

from io import BytesIO as StringIO

from twisted.internet import address
from twisted.logger import ILogObserver, Logger
from twisted.mail._cred import CramMD5ClientAuthenticator
from twisted.python import log
from twisted.web.http import HTTPChannel, Request
from twisted.web._http2 import H2Connection

from zope.interface import implementer

from globaleaks.rest.errors import InputValidationError


def null_function(*args, **kw):
    pass


def mock_Request_getClientIP(self):
    if isinstance(self.client, (address.IPv4Address, address.IPv6Address)):
        return self.client.host

    return None


def mock_Request_gotLength(self, length):
    if length is not None and length > 2 * 1024 * 1024:
        raise InputValidationError("Request exceeding max size of 2MB")

    self.content = StringIO()


def mock_Request_redirect(self, url):
    self.setResponseCode(301)
    self.setHeader(b"location", url)


_orig_request_write = Request.write
def mock_Request_write(self, data):
    # Backport Twisted #9410 from  19.7.0
    if self._disconnected:
        return

    return _orig_request_write(self, data)


def mock_CramMD5ClientAuthenticator_challengeResponse(self, secret, chal):
    response = hmac.HMAC(secret, chal, digestmod=hashlib.md5).hexdigest()
    return self.user + b' ' + response.encode('ascii')


Request.getClientIP = mock_Request_getClientIP
Request.gotLength = mock_Request_gotLength
Request.parseCookies = null_function
Request.redirect = mock_Request_redirect
Request.write = mock_Request_write

CramMD5ClientAuthenticator.challengeResponse = mock_CramMD5ClientAuthenticator_challengeResponse


@implementer(ILogObserver)
class NullObserver(object):
    def __call__(self, event):
        pass


log.msg = log.info = log.err = null_function


null_logger = Logger(observer=NullObserver())
Request._log = null_logger
HTTPChannel._log = null_logger
H2Connection._log = null_logger
